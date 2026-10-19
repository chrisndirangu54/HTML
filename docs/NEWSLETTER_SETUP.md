# Mailchimp newsletter

Set `mailchimpSignupUrl` in `assets/js/site-config.js` to the audience's public HTTPS hosted signup URL, then deploy Hosting. Do not place a Mailchimp API key here. The newsletter page deliberately shows signup as unavailable until this URL is configured.

The admin panel also includes an editable Mailchimp URL field. Its authenticated save endpoint (`adminSaveNewsletterSettings`) persists the URL using the existing siteContent collection, and the public `getNewsletterSettings` endpoint exposes only that URL. These endpoints are implemented but not deployed in the Hosting-only release. Configure functionsBaseUrl after deploying the backend to enable saving and public loading.

Configure the Mailchimp audience/signup form and consent settings for events, podcasts, training and blog updates. Send those campaigns from Mailchimp. Website account creation does not subscribe someone to marketing emails.

For new-blog emails, configure a Mailchimp RSS campaign with `https://tekntandao.web.app/rss.xml`. The feed is regenerated from the published local `data/blogs.json` entries on each Hosting deployment. This is not a live Strapi feed: CMS-only changes require a separate feed integration or export before deployment.

Mailchimp instructions:
- https://mailchimp.com/help/share-your-signup-form/
- https://mailchimp.com/help/share-your-blog-posts-with-mailchimp/

The Firebase account `chrisndirangu54@gmail.com` has verified custom claims `role: admin` and `superAdmin: true`. Use Forgot password on the sign-in page to set its password. Existing admin operations require the configured Functions backend; Hosting alone does not deploy it. Local Strapi editing is available separately at http://127.0.0.1:1337/admin.
