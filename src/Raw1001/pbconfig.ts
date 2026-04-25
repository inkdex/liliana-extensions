/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import { ContentRating } from "@paperback/types";
import { basePbConfig } from "../generic/config";

let pbConfig = basePbConfig;

pbConfig.name = "Raw1001";
pbConfig.description = "Extension that pulls content from raw1001.net.";
pbConfig.language = "ja";
pbConfig.contentRating = ContentRating.MATURE;
pbConfig.developers = [{ name: "deskpacito", github: "https://github.com/deskpacito" }];

export default pbConfig;
