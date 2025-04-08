import React from 'react';
import { Box, Container, Typography, Breadcrumbs, Link } from '@mui/material';
import PendingDocuments from '../../components/admin/PendingDocuments';
import AdminLayout from '../../components/layouts/AdminLayout';

export default function ApprovalPage() {
  return (
    <AdminLayout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link color="inherit" href="/admin">
              Admin
            </Link>
            <Typography color="text.primary">Document Approval</Typography>
          </Breadcrumbs>
          <Typography variant="h4" component="h1" sx={{ mt: 2 }}>
            Document Approval Queue
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Review, approve or reject documents before they're added to the knowledge base.
          </Typography>
        </Box>
        
        <PendingDocuments />
      </Container>
    </AdminLayout>
  );
} 