const express = require('express');
const agentRoutes = require('./routes/agentRoutes');
const app = express();
app.use(express.json());
app.use('/api/agent', agentRoutes);
app.listen(3000, ()=>console.log('Backend running on 3000'));