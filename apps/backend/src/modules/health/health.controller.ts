import { Controller, Get } from '@nestjs/common';

/**
 * Controller responsible for handling health check endpoints.
 * Acts as a mechanism to verify if the application is running and operational.
 *
 * The controller is mapped to the `/api/health` route.
 */
@Controller('/api/health')
export class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}
