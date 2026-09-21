/* ==========================================================================
   GLT Fireworks - cloud settings
   Fill these in after creating your Supabase project.
   The full step-by-step guide is in  supabase/SETUP-GUIDE.html
   ========================================================================== */
window.GLT_CONFIG = {

  // Supabase dashboard -> Settings -> API Keys
  //   SUPABASE_URL      = the "https://pzndsyvrnbxzvkdrmafq.supabase.co"   (looks like https://abcdefgh.supabase.co)
  //   SUPABASE_ANON_KEY = the "sb_publishable_Bnp4_RFNuG6RFn5XLGQiOw_0830l3bf" (starts with sb_publishable_ ...)
  //                       If you only see the older keys, use the "anon" key instead.
  // These two are safe to put here - the database only answers logged-in staff.
  // NEVER paste the "secret" or "service_role" key anywhere in this project.
  SUPABASE_URL: 'https://pzndsyvrnbxzvkdrmafq.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_Bnp4_RFNuG6RFn5XLGQiOw_0830l3bf',

  // How staff logins are named inside Supabase.
  // Staff type just a short username (admin, siva ...). Behind the scenes each
  // username becomes an e-mail address that YOU create once in Supabase.
  //
  // Recommended: put YOUR OWN real e-mail address here. The username is added
  // with a "+" tag, so username "siva" becomes  yourname+siva@gmail.com
  // (mail systems treat that as a real, valid address; no mail is ever sent).
  LOGIN_EMAIL_BASE: 'gbhavani1018@gmail.com',           // e.g. 'yourname@gmail.com'

  // Only used when LOGIN_EMAIL_BASE is empty: username@<this domain>.
  // (Supabase may refuse made-up domains, so the line above is safer.)
  LOGIN_EMAIL_DOMAIN: 'glt-fireworks.app'
};
