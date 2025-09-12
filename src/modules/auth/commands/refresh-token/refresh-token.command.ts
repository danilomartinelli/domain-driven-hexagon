import { Command, CommandProps } from '@libs/ddd/command.base';

export class RefreshTokenCommand extends Command {
  readonly refreshToken: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;

  constructor(props: CommandProps<RefreshTokenCommand>) {
    super(props);
    this.refreshToken = props.refreshToken;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
  }
}