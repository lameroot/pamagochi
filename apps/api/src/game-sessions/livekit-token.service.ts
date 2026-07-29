import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import { AppConfigService } from '../config/app-config.service.js';

export interface RoomTokenGrants {
  roomName: string;
  identity: string;
  ttlSeconds: number;
  canPublish: boolean;
  canSubscribe: boolean;
}

@Injectable()
export class LivekitTokenService {
  constructor(private readonly config: AppConfigService) {}

  getLivekitUrl(): string {
    const url = this.config.livekitUrl;
    if (!url) {
      throw new ServiceUnavailableException('LiveKit is not configured');
    }
    return url;
  }

  async createRoomToken(grants: RoomTokenGrants): Promise<string> {
    const { apiKey, apiSecret } = this.config.livekitCredentials;
    if (!apiKey || !apiSecret) {
      throw new ServiceUnavailableException('LiveKit is not configured');
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: grants.identity,
      ttl: grants.ttlSeconds,
    });
    token.addGrant({
      roomJoin: true,
      room: grants.roomName,
      canPublish: grants.canPublish,
      canSubscribe: grants.canSubscribe,
      canPublishData: true,
    });
    return token.toJwt();
  }
}
