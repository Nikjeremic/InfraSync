import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const Settings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold' }}>
        Settings
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6">
            Application Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This page will contain application settings, notifications preferences, and system configuration options.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Settings; 