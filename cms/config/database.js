export default ({ env }) => ({
 connection: {
  client: 'postgres',
  connection: {
   connectionString: env('DATABASE_URL'),
   ssl: env.bool('DATABASE_SSL',true) ? { rejectUnauthorized: env.bool('DATABASE_SSL_VERIFY',true) } : false,
  },
  pool: { min: 0, max: 5 },
 },
});
