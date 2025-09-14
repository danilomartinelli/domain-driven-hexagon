import { Command, CommandProps } from '@libs/ddd/command.base';

export class RegisterCommand extends Command {
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly address: {
    country: string;
    postalCode: string;
    street: string;
  };
  readonly ipAddress?: string;
  readonly userAgent?: string;

  constructor(props: CommandProps<RegisterCommand>) {
    super(props);
    this.email = props.email;
    this.password = props.password;
    this.confirmPassword = props.confirmPassword;
    this.address = props.address;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
  }
}
