import { Command, CommandProps } from '@libs/ddd/command.base';

export class LoginCommand extends Command {
  readonly email: string;
  readonly password: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;

  constructor(props: CommandProps<LoginCommand>) {
    super(props);
    this.email = props.email;
    this.password = props.password;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
  }
}