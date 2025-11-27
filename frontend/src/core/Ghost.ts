export type GhostColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'white' | 'gray';

export interface GhostPosition {
  x: number;
  y: number;
}

export interface GhostState {
  id: string;
  name: string;
  color: GhostColor;
  position: GhostPosition;
  velocity: { x: number; y: number };
  isDashing: boolean;
  dashCooldown: number;
  hasBomb: boolean;
}

export class Ghost {
  id: string;
  name: string;
  color: GhostColor;
  position: GhostPosition;
  velocity: { x: number; y: number };
  isDashing: boolean;
  dashCooldown: number;
  hasBomb: boolean;

  private readonly baseSpeed = 3;
  private readonly dashSpeed = 8;
  private readonly dashDuration = 500;
  private readonly dashCooldownTime = 2000;
  private dashTimeout?: number;

  constructor(id: string, name: string, color: GhostColor, startX: number, startY: number) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.position = { x: startX, y: startY };
    this.velocity = { x: 0, y: 0 };
    this.isDashing = false;
    this.dashCooldown = 0;
    this.hasBomb = false;
  }

  move(dx: number, dy: number, bounds: { width: number; height: number }) {
    const speed = this.isDashing ? this.dashSpeed : this.baseSpeed;

    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 0) {
      this.velocity.x = (dx / magnitude) * speed;
      this.velocity.y = (dy / magnitude) * speed;
    } else {
      this.velocity.x = 0;
      this.velocity.y = 0;
    }

    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;

    this.position.x = Math.max(20, Math.min(bounds.width - 20, this.position.x));
    this.position.y = Math.max(20, Math.min(bounds.height - 20, this.position.y));
  }

  activateDash() {
    if (this.dashCooldown <= 0 && !this.isDashing) {
      this.isDashing = true;
      this.dashTimeout = window.setTimeout(() => {
        this.isDashing = false;
        this.dashCooldown = this.dashCooldownTime;
      }, this.dashDuration);
    }
  }

  updateCooldown(deltaTime: number) {
    if (this.dashCooldown > 0) {
      this.dashCooldown = Math.max(0, this.dashCooldown - deltaTime);
    }
  }

  distanceTo(other: Ghost): number {
    const dx = this.position.x - other.position.x;
    const dy = this.position.y - other.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getState(): GhostState {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      position: { ...this.position },
      velocity: { ...this.velocity },
      isDashing: this.isDashing,
      dashCooldown: this.dashCooldown,
      hasBomb: this.hasBomb
    };
  }

  cleanup() {
    if (this.dashTimeout) {
      clearTimeout(this.dashTimeout);
    }
  }
}

export const GHOST_COLORS: GhostColor[] = [
  'blue', 'purple', 'pink', 'red', 'orange',
  'yellow', 'green', 'cyan', 'white', 'gray'
];

export const getGhostColorHex = (color: GhostColor): string => {
  const colorMap: Record<GhostColor, string> = {
    blue: '#3b82f6',
    purple: '#a855f7',
    pink: '#ec4899',
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    cyan: '#06b6d4',
    white: '#f3f4f6',
    gray: '#6b7280'
  };
  return colorMap[color];
};
