import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const Analytics: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold' }}>
        Analytics & Reports
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6">
            Premium Analytics Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This page will contain advanced analytics, performance metrics, trends, and exportable reports for premium users.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Analytics; 