"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
require("@/styles/globals.css");
function App({ Component, pageProps }) {
    return React.createElement(Component, { ...pageProps });
}
