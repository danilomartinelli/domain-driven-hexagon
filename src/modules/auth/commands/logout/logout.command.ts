import { Command, CommandProps } from '@libs/ddd/command.base';

export class LogoutCommand extends Command {
  readonly userId: string;
  readonly refreshToken?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly logoutAllDevices?: boolean;

  constructor(props: CommandProps<LogoutCommand>) {
    super(props);
    this.userId = props.userId;
    this.refreshToken = props.refreshToken;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
    this.logoutAllDevices = props.logoutAllDevices ?? false;
  }
}
