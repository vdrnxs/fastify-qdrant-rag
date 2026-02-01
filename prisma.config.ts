import 'dotenv/config';

export default {
  datasource: {
    url: process.env.DATABASE_URL || 'file:./data/tracking.db'
  }
};
