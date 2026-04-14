import { Hono } from 'hono'
import type { AppEnv } from './types.js'
import { sessionAuth } from './middleware/auth.js'
import { csrfIssuance } from './middleware/csrf.js'
import { registerAuthRoutes } from './routes/auth-routes.js'
import { registerBookRoutes } from './routes/book-routes.js'
import { registerCoverRoutes } from './routes/cover-routes.js'
import { registerAdminRoutes } from './routes/admin-routes.js'
import { HomeLoggedInPage } from './templates/pages/home-logged-in-page.js'
import { HomeLoggedOutPage } from './templates/pages/home-logged-out-page.js'

const app = new Hono<AppEnv>()

// 全リクエストでセッション復元だけ先に行う。
app.use('*', sessionAuth)

// トップページでは CSRF トークンを発行して初期 UI を返す。
app.get('/', csrfIssuance, (c) => {
  const authUser = c.get('authUser')

  if (authUser) {
    return c.html(<HomeLoggedInPage csrfToken={c.get('csrfToken')} authUser={authUser} />)
  }

  return c.html(<HomeLoggedOutPage />)
})

// 認証関連ルートを登録する。
registerAuthRoutes(app)
// 本の一覧・登録ルートを登録する。
registerBookRoutes(app)
// 書影アップロードルートを登録する。
registerCoverRoutes(app)
// 管理者向けルートを登録する。
registerAdminRoutes(app)

export default app
