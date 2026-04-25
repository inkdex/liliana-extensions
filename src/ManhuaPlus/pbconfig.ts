/* SPDX-License-Identifier: GPL-3.0-or-later */
/* Copyright © 2026 Inkdex */

import { ContentRating } from "@paperback/types";
import { basePbConfig } from "../generic/config";

let pbConfig = basePbConfig;

pbConfig.name = "ManhuaPlus";
pbConfig.description = "Extension that pulls content from manhuaplus.org.";
pbConfig.contentRating = ContentRating.MATURE;
pbConfig.developers = [{ name: "deskpacito", github: "https://github.com/deskpacito" }];

export default pbConfig;
