/// <reference types="node" />
import 'dotenv/config';
import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://postgres:1234@localhost:5432/projectInfo_db?schema=public",
  },
});