"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const material_1 = require("@mui/material");
const Menu_1 = __importDefault(require("@mui/icons-material/Menu"));
const Dashboard_1 = __importDefault(require("@mui/icons-material/Dashboard"));
const Article_1 = __importDefault(require("@mui/icons-material/Article"));
const Approval_1 = __importDefault(require("@mui/icons-material/Approval"));
const Settings_1 = __importDefault(require("@mui/icons-material/Settings"));
const Logout_1 = __importDefault(require("@mui/icons-material/Logout"));
const link_1 = __importDefault(require("next/link"));
const router_1 = require("next/router");
const drawerWidth = 280;
const AdminLayout = ({ children }) => {
    const [mobileOpen, setMobileOpen] = react_1.default.useState(false);
    const router = (0, router_1.useRouter)();
    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };
    const menuItems = [
        { text: 'Dashboard', icon: <Dashboard_1.default />, href: '/admin' },
        { text: 'Document Approval', icon: <Approval_1.default />, href: '/admin/approval' },
        { text: 'Knowledge Base', icon: <Article_1.default />, href: '/admin/knowledge-base' },
        { text: 'Settings', icon: <Settings_1.default />, href: '/admin/settings' },
    ];
    const drawer = (<div>
      <material_1.Toolbar>
        <material_1.Typography variant="h6" noWrap component="div">
          RAG Admin
        </material_1.Typography>
      </material_1.Toolbar>
      <material_1.Divider />
      <material_1.List>
        {menuItems.map((item) => (<link_1.default href={item.href} key={item.text} passHref style={{ textDecoration: 'none', color: 'inherit' }}>
            <material_1.ListItem disablePadding>
              <material_1.ListItemButton selected={router.pathname === item.href}>
                <material_1.ListItemIcon>{item.icon}</material_1.ListItemIcon>
                <material_1.ListItemText primary={item.text}/>
              </material_1.ListItemButton>
            </material_1.ListItem>
          </link_1.default>))}
      </material_1.List>
      <material_1.Divider />
      <material_1.List>
        <material_1.ListItem disablePadding>
          <material_1.ListItemButton>
            <material_1.ListItemIcon>
              <Logout_1.default />
            </material_1.ListItemIcon>
            <material_1.ListItemText primary="Logout"/>
          </material_1.ListItemButton>
        </material_1.ListItem>
      </material_1.List>
    </div>);
    return (<material_1.Box sx={{ display: 'flex' }}>
      <material_1.CssBaseline />
      <material_1.AppBar position="fixed" sx={{
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            ml: { sm: `${drawerWidth}px` },
        }}>
        <material_1.Toolbar>
          <material_1.IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}>
            <Menu_1.default />
          </material_1.IconButton>
          <material_1.Typography variant="h6" noWrap component="div">
            Sales Team Knowledge Base Admin
          </material_1.Typography>
        </material_1.Toolbar>
      </material_1.AppBar>
      <material_1.Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }} aria-label="mailbox folders">
        <material_1.Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{
            keepMounted: true, // Better open performance on mobile.
        }} sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}>
          {drawer}
        </material_1.Drawer>
        <material_1.Drawer variant="permanent" sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }} open>
          {drawer}
        </material_1.Drawer>
      </material_1.Box>
      <material_1.Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
        <material_1.Toolbar />
        {children}
      </material_1.Box>
    </material_1.Box>);
};
exports.default = AdminLayout;
