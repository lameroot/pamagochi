import Phaser from 'phaser';
import type { ServiceContainer } from '../services/ServiceContainer.js';

export function getGameServices(scene: Phaser.Scene): ServiceContainer {
  const services = scene.game.registry.get('services');
  if (!services) throw new Error('game_services_missing');
  return services as ServiceContainer;
}
