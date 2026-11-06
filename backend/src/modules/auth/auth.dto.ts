import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

/** Same rules as the frontend's strength checklist. 72 = bcrypt's input limit. */
function StrongPassword(): PropertyDecorator {
  return (target, key) => {
    IsString()(target, key);
    MinLength(8, { message: 'Password must be at least 8 characters' })(target, key);
    MaxLength(72, { message: 'Password must be at most 72 characters' })(target, key);
    Matches(/[A-Za-z]/, { message: 'Password must contain a letter' })(target, key);
    Matches(/\d/, { message: 'Password must contain a number' })(target, key);
  };
}

export class RegisterDto {
  @ApiProperty({ example: 'alok@example.com' })
  @Transform(trimLower) @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(190)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72, description: 'At least 8 characters with a letter and a number' })
  @StrongPassword()
  password: string;

  @ApiProperty({ example: 'Alok Sen' })
  @Transform(trim) @IsString() @MinLength(2, { message: 'Please enter your name' }) @MaxLength(60)
  displayName: string;

  @ApiProperty({ description: 'Must be true — the user accepted the Terms and Privacy Policy' })
  @Equals(true, { message: 'Please accept the Terms to continue' })
  acceptTerms: boolean;
}

export class LoginDto {
  @ApiProperty() @Transform(trimLower) @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(190) email: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(72) password: string;
  @ApiPropertyOptional({ description: 'Keep me signed in (persistent cookie). Otherwise the session ends when the browser closes.' })
  @IsOptional() @IsBoolean() remember?: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty() @Transform(trimLower) @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(190) email: string;
}

export class ResetTokenDto {
  @ApiProperty() @IsString() @Matches(/^[A-Za-z0-9_-]{40,64}$/, { message: 'This reset link is invalid.' }) token: string;
}

export class ResetPasswordDto extends ResetTokenDto {
  @ApiProperty() @StrongPassword() password: string;
}
