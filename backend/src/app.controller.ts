import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { STYLE_PRESETS } from './media/style-presets';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('style-presets')
  getStylePresets() {
    return Object.values(STYLE_PRESETS).map(({ key, label, isPro }) => ({ key, label, isPro }));
  }
}