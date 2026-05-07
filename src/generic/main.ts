/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import {
  BasicRateLimiter,
  ContentRating,
  DiscoverSectionType,
  PaperbackInterceptor,
  type Chapter,
  type ChapterDetails,
  type ChapterProviding,
  type DiscoverSection,
  type DiscoverSectionItem,
  type DiscoverSectionProviding,
  type Extension,
  type MangaProviding,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SearchResultsProviding,
  type SourceManga,
  type Request,
} from "@paperback/types";

import { MainInterceptor, fetchRequest } from "./network";
import { LilianaParser } from "./parsers";

export interface LilianaParams {
  domain: string;
  contentRating: ContentRating;
  language: string;
  parser?: LilianaParser;
  requestManager?: PaperbackInterceptor;
  rateLimiter?: BasicRateLimiter;
}

type LilianaImplementation = Extension &
  DiscoverSectionProviding &
  SearchResultsProviding &
  MangaProviding &
  ChapterProviding;

export abstract class Liliana implements LilianaImplementation {
  readonly domain: string;
  readonly defaultContentRating: ContentRating;
  readonly language: string;
  readonly searchMangaSelector: string;
  parser: LilianaParser;
  mainRateLimiter: BasicRateLimiter;
  mainInterceptor: PaperbackInterceptor;

  constructor(params: LilianaParams) {
    this.domain = params.domain;
    this.defaultContentRating = params.contentRating;
    this.language = params.language;
    this.searchMangaSelector = "div#main div.grid > div";
    this.parser = params.parser ?? new LilianaParser();
    this.mainInterceptor = params.requestManager ?? new MainInterceptor("main");
    this.mainRateLimiter =
      params.rateLimiter ??
      new BasicRateLimiter("main", {
        numberOfRequests: 15,
        bufferInterval: 10,
        ignoreImages: true,
      });
  }

  async initialise(): Promise<void> {
    this.mainRateLimiter.registerInterceptor();
    this.mainInterceptor.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    const popularSection: DiscoverSection = {
      id: "popular",
      title: "Popular Manga",
      subtitle: "Most popular this week",
      type: DiscoverSectionType.prominentCarousel,
    };

    const latestSection: DiscoverSection = {
      id: "latest",
      title: "Latest Updates",
      subtitle: "Recently updated manga",
      type: DiscoverSectionType.simpleCarousel,
    };

    return [popularSection, latestSection];
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata: number | undefined,
  ): Promise<PagedResults<DiscoverSectionItem>> {
    const page = metadata ?? 1;
    let url = "";

    switch (section.id) {
      case "popular":
        url = `${this.domain}/ranking/week/${page}`;
        break;
      case "latest":
        url = `${this.domain}/all-manga/${page}/?sort=last_update&status=0`;
        break;
      default:
        return { items: [] };
    }

    const request: Request = {
      url: url,
      method: "GET",
    };

    const html = await fetchRequest(request);
    const items = this.parser.parseDiscoverSectionItems(
      html,
      section,
      this.domain,
      this.searchMangaSelector,
    );

    return {
      items: items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  // TODO: Implement getAdvancedSearchForm for search filters

  async getSearchResults(
    query: SearchQuery<never>,
    metadata?: number,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata ?? 1;
    const url = `${this.domain}/search/${page}/?keyword=${encodeURIComponent(query.title)}`;
    const request: Request = {
      url: url,
      method: "GET",
    };

    const html = await fetchRequest(request);
    const items = this.parser.parseSearchResults(html, this.domain, this.searchMangaSelector);

    return {
      items: items,
      metadata: items.length > 0 ? page + 1 : undefined,
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const request: Request = {
      url: `${this.domain}/${mangaId}`,
      method: "GET",
    };

    const html = await fetchRequest(request);
    return this.parser.parseMangaDetails(html, mangaId, this.domain, this.defaultContentRating);
  }

  async getChapters(sourceManga: SourceManga, _sinceDate?: Date): Promise<Chapter[]> {
    const request: Request = {
      url: `${this.domain}/${sourceManga.mangaId}`,
      method: "GET",
    };

    const html = await fetchRequest(request);
    return this.parser.parseChapterList(html, sourceManga, this.domain, this.language);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const request: Request = {
      url: `${this.domain}/${chapter.chapterId}`,
      method: "GET",
    };

    const html = await fetchRequest(request);
    const numericChapterId = this.parser.getNumericChapterId(html);

    if (!numericChapterId) {
      throw new Error("Failed to find CHAPTER_ID");
    }

    // Now call AJAX
    const ajaxUrl = `${this.domain}/ajax/image/list/chap/${numericChapterId}`;
    const ajaxRequest: Request = {
      url: ajaxUrl,
      method: "GET",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    };

    const ajaxString = await fetchRequest(ajaxRequest);
    const ajaxJson = JSON.parse(ajaxString);

    if (!ajaxJson.html) {
      throw new Error("Failed to get image list HTML");
    }

    const pages = this.parser.parseAjaxImageList(ajaxJson.html);

    return {
      id: chapter.chapterId,
      mangaId: chapter.sourceManga.mangaId,
      pages: pages,
    };
  }
}
