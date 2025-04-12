"use strict";
/**
 * Base Types for Multi-Modal Processing
 *
 * This file contains fundamental type definitions that are shared across
 * multiple modules to avoid circular dependencies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualContentType = void 0;
/**
 * Types of visual content that can be processed
 */
var VisualContentType;
(function (VisualContentType) {
    VisualContentType["CHART"] = "chart";
    VisualContentType["TABLE"] = "table";
    VisualContentType["DIAGRAM"] = "diagram";
    VisualContentType["GRAPH"] = "graph";
    VisualContentType["IMAGE"] = "image";
    VisualContentType["FIGURE"] = "figure";
    VisualContentType["SCREENSHOT"] = "screenshot";
    VisualContentType["INFOGRAPHIC"] = "infographic";
    VisualContentType["UNKNOWN"] = "unknown";
})(VisualContentType || (exports.VisualContentType = VisualContentType = {}));
