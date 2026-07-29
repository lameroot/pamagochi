import { Controller, Get, UseGuards } from '@nestjs/common';
import type { SceneSpec } from '@pamagochi/contracts';
import { AuthGuard } from '../auth/auth.guard.js';

const DEMO_SCENE: SceneSpec = {
  version: 1,
  title: 'Памагочи: первый запуск',
  backgroundAssetKey: 'bg_meadow',
  objects: [
    { id: 'hero', assetKey: 'char_fox', x: 400, y: 300, scale: 1, rotationDegrees: 0 },
    { id: 'tree-1', assetKey: 'prop_tree', x: 120, y: 260, scale: 1, rotationDegrees: 0 },
    { id: 'star-1', assetKey: 'prop_star', x: 640, y: 160, scale: 0.8, rotationDegrees: 0 },
  ],
};

@Controller('api/demo')
@UseGuards(AuthGuard)
export class DemoController {
  @Get('scene')
  getScene(): SceneSpec {
    return DEMO_SCENE;
  }
}
