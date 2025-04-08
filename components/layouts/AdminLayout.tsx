import React, { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

// Import custom UI components
import Box from '../ui/Box';
import Divider from '../ui/Divider';
import Typography from '../ui/Typography';
import AppBar from '../ui/AppBar';
import Toolbar from '../ui/Toolbar';
import Drawer from '../ui/Drawer';
import IconButton from '../ui/IconButton';
import List from '../ui/List';
import ListItem from '../ui/ListItem';
import ListItemButton from '../ui/ListItemButton';
import ListItemIcon from '../ui/ListItemIcon';
import ListItemText from '../ui/ListItemText';
import CssBaseline from '../ui/CssBaseline';

// Import custom icons
import {
  MenuIcon,
  DashboardIcon,
  ArticleIcon,
  ApprovalIcon,
  SettingsIcon
} from '../ui/icons';

const drawerWidth = 280;

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, href: '/admin' },
    { text: 'Document Approval', icon: <ApprovalIcon />, href: '/admin/approval' },
    { text: 'Knowledge Base', icon: <ArticleIcon />, href: '/admin/knowledge-base' },
    { text: 'Settings', icon: <SettingsIcon />, href: '/admin/settings' },
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" component="div">
          RAG Admin
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <Link href={item.href} key={item.text} passHref style={{ textDecoration: 'none', color: 'inherit' }}>
            <ListItem disablePadding>
              <ListItemButton selected={router.pathname === item.href}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          </Link>
        ))}
      </List>
    </div>
  );

  return (
    <Box display="flex">
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div">
            Sales Team Knowledge Base Admin
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default AdminLayout; 