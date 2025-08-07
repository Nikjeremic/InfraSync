import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

const Profile: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 'bold' }}>
        User Profile
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6">
            Profile Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This page will contain user profile information, preferences, and account settings.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Profile; 