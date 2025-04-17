### Creating Properties Index


```shell
CLOUDFLARE_ACCOUNT_ID=<acount_id> wrangler vectorize create b2c-ai-store --dimensions=1536 --metric=cosine
```


### First time setup for B2C AI


Create D1 databases needed
```shell
## https://developers.cloudflare.com/d1/get-started/#6-deploy-your-database
wrangler d1 execute ai-db --remote --file=./src/db/b2c_session.sql
```

