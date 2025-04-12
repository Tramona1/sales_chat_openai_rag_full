"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const link_1 = __importDefault(require("next/link"));
const router_1 = require("next/router");
// Import custom UI components
const Box_1 = __importDefault(require("../ui/Box"));
const Divider_1 = __importDefault(require("../ui/Divider"));
const Typography_1 = __importDefault(require("../ui/Typography"));
const AppBar_1 = __importDefault(require("../ui/AppBar"));
const Toolbar_1 = __importDefault(require("../ui/Toolbar"));
const Drawer_1 = __importDefault(require("../ui/Drawer"));
const IconButton_1 = __importDefault(require("../ui/IconButton"));
const List_1 = __importDefault(require("../ui/List"));
const ListItem_1 = __importDefault(require("../ui/ListItem"));
const ListItemButton_1 = __importDefault(require("../ui/ListItemButton"));
const ListItemIcon_1 = __importDefault(require("../ui/ListItemIcon"));
const ListItemText_1 = __importDefault(require("../ui/ListItemText"));
const CssBaseline_1 = __importDefault(require("../ui/CssBaseline"));
// Import custom icons
const icons_1 = require("../ui/icons");
const drawerWidth = 280;
const AdminLayout = ({ children }) => {
    const [mobileOpen, setMobileOpen] = (0, react_1.useState)(false);
    const router = (0, router_1.useRouter)();
    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };
    const menuItems = [
        { text: 'Dashboard', icon: <icons_1.DashboardIcon />, href: '/admin' },
        { text: 'Document Approval', icon: <icons_1.ApprovalIcon />, href: '/admin/approval' },
        { text: 'Knowledge Base', icon: <icons_1.ArticleIcon />, href: '/admin/knowledge-base' },
        { text: 'Settings', icon: <icons_1.SettingsIcon />, href: '/admin/settings' },
    ];
    const drawer = (<div>
      <Toolbar_1.default>
        <Typography_1.default variant="h6" component="div">
          RAG Admin
        </Typography_1.default>
      </Toolbar_1.default>
      <Divider_1.default />
      <List_1.default>
        {menuItems.map((item) => (<link_1.default href={item.href} key={item.text} passHref style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItem_1.default disablePadding>
              <ListItemButton_1.default selected={router.pathname === item.href}>
                <ListItemIcon_1.default>{item.icon}</ListItemIcon_1.default>
                <ListItemText_1.default primary={item.text}/>
              </ListItemButton_1.default>
            </ListItem_1.default>
          </link_1.default>))}
      </List_1.default>
    </div>);
    return (<Box_1.default display="flex">
      <CssBaseline_1.default />
      <AppBar_1.default position="fixed" sx={{
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            ml: { sm: `${drawerWidth}px` },
        }}>
        <Toolbar_1.default>
          <IconButton_1.default color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}>
            <icons_1.MenuIcon />
          </IconButton_1.default>
          <Typography_1.default variant="h6" component="div">
            Sales Team Knowledge Base Admin
          </Typography_1.default>
        </Toolbar_1.default>
      </AppBar_1.default>
      <Box_1.default component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }} aria-label="mailbox folders">
        <Drawer_1.default variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{
            keepMounted: true, // Better open performance on mobile.
        }} sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}>
          {drawer}
        </Drawer_1.default>
        <Drawer_1.default variant="permanent" sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }} open>
          {drawer}
        </Drawer_1.default>
      </Box_1.default>
      <Box_1.default component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar_1.default />
        {children}
      </Box_1.default>
    </Box_1.default>);
};
exports.default = AdminLayout;
