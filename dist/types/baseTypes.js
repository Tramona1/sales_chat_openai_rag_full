/**
 * Base Types for Multi-Modal Processing
 *
 * This file contains fundamental type definitions that are shared across
 * multiple modules to avoid circular dependencies.
 */
/**
 * Types of visual content that can be processed
 */
export var VisualContentType;
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
})(VisualContentType || (VisualContentType = {}));
