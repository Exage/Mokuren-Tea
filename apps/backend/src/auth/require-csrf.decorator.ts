import { SetMetadata } from '@nestjs/common'

export const REQUIRE_CSRF = 'auth.require-csrf'

// Login needs CSRF protection even before the browser has a session cookie.
export const RequireCsrf = () => SetMetadata(REQUIRE_CSRF, true)
