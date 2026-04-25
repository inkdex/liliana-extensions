/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import {
  type Chapter,
  type DiscoverSection,
  type DiscoverSectionItem,
  type SearchResultItem,
  type SourceManga,
  type Tag,
} from "@paperback/types";
import { ContentRating } from "@paperback/types";
import * as cheerio from "cheerio";

export class LilianaParser {
  parseMangaDetails(
    html: string,
    mangaId: string,
    domain: string,
    defaultContentRating: ContentRating,
  ): SourceManga {
    const $ = cheerio.load(html);
    const title = $(".a2 header h1").text().trim();
    const thumbnail = this.getImgAttr($(".a1 > figure img"), domain);
    const description = $("div#syn-target").text().trim();

    const secondaryTitles: string[] = [];
    const aliasText = $(".a2 header p").text().trim();
    if (aliasText.includes("別名:")) {
      const alias = aliasText.replace("別名:", "").trim();
      if (alias) secondaryTitles.push(alias);
    }

    const author = $("div.y6x11p i.fas.fa-user + span.dt").text().replace("updating", "").trim();
    const statusText = $("div.y6x11p i.fas.fa-rss + span.dt").text().toLowerCase();

    let status = "ONGOING"; // Default
    if (statusText.includes("completed") || statusText.includes("hoàn thành")) {
      status = "COMPLETED";
    } else if (statusText.includes("drop") || statusText.includes("canceled")) {
      status = "COMPLETED";
    }

    const genres: Tag[] = [];
    $(".a2 div > a[rel='tag'].label").each((_: any, el: any) => {
      const id = $(el).attr("href")?.split("/").pop() ?? "";
      const label = $(el).text().trim();
      if (id && label) {
        genres.push({ id: id, title: label });
      }
    });

    return {
      mangaId: mangaId,
      mangaInfo: {
        primaryTitle: title,
        secondaryTitles: secondaryTitles,
        thumbnailUrl: thumbnail,
        synopsis: description,
        author: author,
        status: status,
        contentRating: defaultContentRating,
        tagGroups: [
          {
            id: "genres",
            title: "Genres",
            tags: genres,
          },
        ],
      },
    };
  }

  parseChapterList(
    html: string,
    sourceManga: SourceManga,
    domain: string,
    language: string,
  ): Chapter[] {
    const $ = cheerio.load(html);
    const chapters: Chapter[] = [];

    $("ul > li.chapter").each((_: any, element: any) => {
      const el = $(element);
      const a = el.find("a");
      const timeElement = el.find("time[datetime]");

      const title = a.text().trim();
      const href = a.attr("href");
      const dateString = timeElement.attr("datetime");

      if (href) {
        const chapterId = href.replace(domain, "").replace(/^\//, "");
        const chapNumMatch = title.match(/(\d+(\.\d+)?)/);
        const chapNum = chapNumMatch && chapNumMatch[0] ? parseFloat(chapNumMatch[0]) : 0;

        const dateValue = dateString ? Number(dateString) : null;

        chapters.push({
          chapterId: chapterId,
          sourceManga: sourceManga,
          langCode: language,
          chapNum: chapNum,
          title: title,
          publishDate: dateValue ? new Date(dateValue * 1000) : new Date(),
          volume: 0,
        });
      }
    });

    return chapters;
  }

  // Helper for step 1 of chapter details
  getNumericChapterId(html: string): string | null {
    const $ = cheerio.load(html);
    let numericChapterId = null;
    $("script").each((_: any, el: any) => {
      const content = $(el).html();
      if (content && content.includes("const CHAPTER_ID")) {
        const match = content.match(/const CHAPTER_ID = (\d+);/);
        if (match && match[1]) {
          numericChapterId = match[1];
        }
      }
    });
    return numericChapterId;
  }

  // Helper for step 2 of chapter details
  parseAjaxImageList(html: string): string[] {
    const $images = cheerio.load(html);

    // Check if any separator has data-index
    const hasDataIndex = $images("div.separator[data-index]").length > 0;

    if (hasDataIndex) {
      const pages: { index: number; url: string }[] = [];
      $images("div.separator[data-index]").each((_: any, el: any) => {
        const element = $images(el);
        const indexStr = element.attr("data-index");
        const index = indexStr ? parseInt(indexStr) : -1;

        let url = element.find("a").attr("href");
        if (!url) url = element.find("img").attr("src");

        if (url && index !== -1) {
          pages.push({ index, url });
        }
      });

      return pages.sort((a, b) => a.index - b.index).map((p) => p.url);
    }

    // Fallback if no data-index
    const pages: string[] = [];
    $images("div.separator").each((_: any, el: any) => {
      const element = $images(el);
      let url = element.find("a").attr("href");
      if (!url) url = element.find("img").attr("src");

      if (url) pages.push(url);
    });

    // If still no pages, strictly try img tags as a last resort (legacy fallback)
    if (pages.length === 0) {
      $images("img").each((_: any, el: any) => {
        const src = $images(el).attr("src");
        if (src) pages.push(src);
      });
    }

    return pages;
  }

  parseDiscoverSectionItems(
    html: string,
    section: DiscoverSection,
    domain: string,
    searchMangaSelector: string,
  ): DiscoverSectionItem[] {
    const $ = cheerio.load(html);
    const items: DiscoverSectionItem[] = [];
    const selector = searchMangaSelector || "div#main div.grid > div";

    $(selector).each((_: any, element: any) => {
      const el = $(element);
      const titleElement = el.find(".text-center a");
      const imgElement = el.find("img");

      const title = titleElement.text().trim();
      const href = titleElement.attr("href");
      const imageUrl = this.getImgAttr(imgElement, domain);

      if (title && href) {
        const id = href.replace(domain, "").replace(/^\//, "");

        items.push({
          type: section.id === "popular" ? "prominentCarouselItem" : "simpleCarouselItem",
          mangaId: id,
          title: title,
          imageUrl: imageUrl,
        });
      }
    });

    return items;
  }

  parseSearchResults(
    html: string,
    domain: string,
    searchMangaSelector: string,
  ): SearchResultItem[] {
    const $ = cheerio.load(html);
    const items: SearchResultItem[] = [];
    const selector = searchMangaSelector || "div#main div.grid > div";

    $(selector).each((_: any, element: any) => {
      const el = $(element);
      const titleElement = el.find(".text-center a");
      const imgElement = el.find("img");

      const title = titleElement.text().trim();
      const href = titleElement.attr("href");
      const imageUrl = this.getImgAttr(imgElement, domain);

      if (title && href) {
        const id = href.replace(domain, "").replace(/^\//, "");
        items.push({
          mangaId: id,
          title: title,
          imageUrl: imageUrl,
        });
      }
    });

    return items;
  }

  getImgAttr(element: any, domain: string): string {
    let url =
      element.attr("data-lazy-src") || element.attr("data-src") || element.attr("src") || "";
    if (url.startsWith("/")) {
      url = domain + url;
    }
    return url;
  }
}
