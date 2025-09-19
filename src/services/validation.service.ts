import { BaseService, ServiceResponse } from './base.service';
import { z } from 'zod';

export interface ValidationRule {
  field: string;
  rules: string[];
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings?: Record<string, string[]>;
}

export interface SanitizationOptions {
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  removeSpecialChars?: boolean;
  allowedChars?: string;
  maxLength?: number;
}

/**
 * Service for data validation and sanitization
 */
export class ValidationService extends BaseService {
  /**
   * Validate data against Zod schema
   */
  async validateWithSchema<T>(
    data: unknown,
    schema: z.ZodSchema<T>
  ): Promise<ServiceResponse<{ data: T; errors?: z.ZodError }>> {
    try {
      this.logOperation('validateWithSchema', { hasData: !!data });

      const result = schema.safeParse(data);

      if (result.success) {
        return this.createResponse({ data: result.data });
      } else {
        return this.createResponse({ 
          data: data as T, 
          errors: result.error 
        }, 'Validation failed');
      }
    } catch (error) {
      this.handleError(error, 'Failed to validate with schema');
    }
  }

  /**
   * Validate email format
   */
  async validateEmail(email: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ email }, ['email']);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = emailRegex.test(email.trim());

      this.logOperation('validateEmail', { email: email.substring(0, 3) + '***', isValid });

      return this.createResponse(isValid, isValid ? 'Valid email' : 'Invalid email format');
    } catch (error) {
      this.handleError(error, 'Failed to validate email');
    }
  }

  /**
   * Validate password strength
   */
  async validatePassword(password: string): Promise<ServiceResponse<{
    isValid: boolean;
    score: number;
    feedback: string[];
  }>> {
    try {
      this.validateRequired({ password }, ['password']);

      const feedback: string[] = [];
      let score = 0;

      // Length check
      if (password.length >= 8) {
        score += 1;
      } else {
        feedback.push('Password must be at least 8 characters long');
      }

      // Uppercase check
      if (/[A-Z]/.test(password)) {
        score += 1;
      } else {
        feedback.push('Password must contain at least one uppercase letter');
      }

      // Lowercase check
      if (/[a-z]/.test(password)) {
        score += 1;
      } else {
        feedback.push('Password must contain at least one lowercase letter');
      }

      // Number check
      if (/\d/.test(password)) {
        score += 1;
      } else {
        feedback.push('Password must contain at least one number');
      }

      // Special character check
      if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        score += 1;
      } else {
        feedback.push('Password must contain at least one special character');
      }

      // Common password check
      const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123'];
      if (commonPasswords.includes(password.toLowerCase())) {
        score = 0;
        feedback.push('Password is too common');
      }

      const isValid = score >= 4;

      this.logOperation('validatePassword', { score, isValid });

      return this.createResponse({
        isValid,
        score,
        feedback,
      });
    } catch (error) {
      this.handleError(error, 'Failed to validate password');
    }
  }

  /**
   * Validate phone number
   */
  async validatePhone(phone: string, countryCode?: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ phone }, ['phone']);

      // Remove all non-digit characters
      const cleanPhone = phone.replace(/\D/g, '');

      let isValid = false;

      if (countryCode === 'BR' || !countryCode) {
        // Brazilian phone validation
        isValid = /^(\+55|55)?(\d{2})(\d{4,5})(\d{4})$/.test(cleanPhone) || 
                 /^(\d{2})(\d{4,5})(\d{4})$/.test(cleanPhone);
      } else if (countryCode === 'US') {
        // US phone validation
        isValid = /^(\+1|1)?(\d{10})$/.test(cleanPhone);
      } else {
        // Generic international phone validation
        isValid = cleanPhone.length >= 10 && cleanPhone.length <= 15;
      }

      this.logOperation('validatePhone', { 
        phone: phone.substring(0, 3) + '***', 
        countryCode, 
        isValid 
      });

      return this.createResponse(isValid, isValid ? 'Valid phone number' : 'Invalid phone number');
    } catch (error) {
      this.handleError(error, 'Failed to validate phone number');
    }
  }

  /**
   * Validate URL format
   */
  async validateUrl(url: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ url }, ['url']);

      let isValid = false;
      try {
        new URL(url);
        isValid = true;
      } catch {
        isValid = false;
      }

      this.logOperation('validateUrl', { url: url.substring(0, 20) + '...', isValid });

      return this.createResponse(isValid, isValid ? 'Valid URL' : 'Invalid URL format');
    } catch (error) {
      this.handleError(error, 'Failed to validate URL');
    }
  }

  /**
   * Validate CPF (Brazilian tax ID)
   */
  async validateCPF(cpf: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ cpf }, ['cpf']);

      // Remove all non-digit characters
      const cleanCPF = cpf.replace(/\D/g, '');

      // Check if has 11 digits
      if (cleanCPF.length !== 11) {
        return this.createResponse(false, 'CPF must have 11 digits');
      }

      // Check if all digits are the same
      if (/^(\d)\1{10}$/.test(cleanCPF)) {
        return this.createResponse(false, 'Invalid CPF format');
      }

      // Validate check digits
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
      }
      let remainder = (sum * 10) % 11;
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(cleanCPF.charAt(9))) {
        return this.createResponse(false, 'Invalid CPF');
      }

      sum = 0;
      for (let i = 0; i < 10; i++) {
        sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
      }
      remainder = (sum * 10) % 11;
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(cleanCPF.charAt(10))) {
        return this.createResponse(false, 'Invalid CPF');
      }

      this.logOperation('validateCPF', { cpf: cleanCPF.substring(0, 3) + '***', isValid: true });

      return this.createResponse(true, 'Valid CPF');
    } catch (error) {
      this.handleError(error, 'Failed to validate CPF');
    }
  }

  /**
   * Validate CNPJ (Brazilian company tax ID)
   */
  async validateCNPJ(cnpj: string): Promise<ServiceResponse<boolean>> {
    try {
      this.validateRequired({ cnpj }, ['cnpj']);

      // Remove all non-digit characters
      const cleanCNPJ = cnpj.replace(/\D/g, '');

      // Check if has 14 digits
      if (cleanCNPJ.length !== 14) {
        return this.createResponse(false, 'CNPJ must have 14 digits');
      }

      // Check if all digits are the same
      if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
        return this.createResponse(false, 'Invalid CNPJ format');
      }

      // Validate first check digit
      let sum = 0;
      const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      for (let i = 0; i < 12; i++) {
        const weight = weights1[i];
        if (weight === undefined) {
          return this.createResponse(false, 'Invalid CNPJ validation');
        }
        sum += parseInt(cleanCNPJ.charAt(i)) * weight;
      }
      let remainder = sum % 11;
      const digit1 = remainder < 2 ? 0 : 11 - remainder;
      if (digit1 !== parseInt(cleanCNPJ.charAt(12))) {
        return this.createResponse(false, 'Invalid CNPJ');
      }

      // Validate second check digit
      sum = 0;
      const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      for (let i = 0; i < 13; i++) {
        const weight = weights2[i];
        if (weight === undefined) {
          return this.createResponse(false, 'Invalid CNPJ validation');
        }
        sum += parseInt(cleanCNPJ.charAt(i)) * weight;
      }
      remainder = sum % 11;
      const digit2 = remainder < 2 ? 0 : 11 - remainder;
      if (digit2 !== parseInt(cleanCNPJ.charAt(13))) {
        return this.createResponse(false, 'Invalid CNPJ');
      }

      this.logOperation('validateCNPJ', { cnpj: cleanCNPJ.substring(0, 3) + '***', isValid: true });

      return this.createResponse(true, 'Valid CNPJ');
    } catch (error) {
      this.handleError(error, 'Failed to validate CNPJ');
    }
  }

  /**
   * Sanitize string input
   */
  async sanitizeString(
    input: string, 
    options: SanitizationOptions = {}
  ): Promise<ServiceResponse<string>> {
    try {
      this.validateRequired({ input }, ['input']);

      let sanitized = input;

      // Trim whitespace
      if (options.trim !== false) {
        sanitized = sanitized.trim();
      }

      // Convert case
      if (options.lowercase) {
        sanitized = sanitized.toLowerCase();
      } else if (options.uppercase) {
        sanitized = sanitized.toUpperCase();
      }

      // Remove special characters
      if (options.removeSpecialChars) {
        sanitized = sanitized.replace(/[^\w\s]/gi, '');
      }

      // Keep only allowed characters
      if (options.allowedChars) {
        const regex = new RegExp(`[^${options.allowedChars}]`, 'g');
        sanitized = sanitized.replace(regex, '');
      }

      // Limit length
      if (options.maxLength && sanitized.length > options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
      }

      this.logOperation('sanitizeString', { 
        originalLength: input.length, 
        sanitizedLength: sanitized.length 
      });

      return this.createResponse(sanitized);
    } catch (error) {
      this.handleError(error, 'Failed to sanitize string');
    }
  }

  /**
   * Validate file upload
   */
  async validateFile(
    file: { name: string; size: number; type: string },
    options: {
      maxSize?: number; // in bytes
      allowedTypes?: string[];
      allowedExtensions?: string[];
    } = {}
  ): Promise<ServiceResponse<{ isValid: boolean; errors: string[] }>> {
    try {
      this.validateRequired({ file }, ['file']);

      const errors: string[] = [];
      const { maxSize = 10 * 1024 * 1024, allowedTypes, allowedExtensions } = options; // 10MB default

      // Check file size
      if (file.size > maxSize) {
        errors.push(`File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`);
      }

      // Check file type
      if (allowedTypes && !allowedTypes.includes(file.type)) {
        errors.push(`File type ${file.type} is not allowed`);
      }

      // Check file extension
      if (allowedExtensions) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!extension || !allowedExtensions.includes(extension)) {
          errors.push(`File extension .${extension || 'unknown'} is not allowed`);
        }
      }

      const isValid = errors.length === 0;

      this.logOperation('validateFile', { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type, 
        isValid 
      });

      return this.createResponse({ isValid, errors });
    } catch (error) {
      this.handleError(error, 'Failed to validate file');
    }
  }

  /**
   * Validate credit card number using Luhn algorithm
   */
  async validateCreditCard(cardNumber: string): Promise<ServiceResponse<{
    isValid: boolean;
    cardType?: string;
  }>> {
    try {
      this.validateRequired({ cardNumber }, ['cardNumber']);

      // Remove all non-digit characters
      const cleanNumber = cardNumber.replace(/\D/g, '');

      // Check if empty or too short
      if (cleanNumber.length < 13 || cleanNumber.length > 19) {
        return this.createResponse({ isValid: false });
      }

      // Luhn algorithm
      let sum = 0;
      let isEven = false;

      for (let i = cleanNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cleanNumber.charAt(i));

        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }

        sum += digit;
        isEven = !isEven;
      }

      const isValid = sum % 10 === 0;

      // Determine card type
      let cardType: string | undefined;
      if (isValid) {
        if (/^4/.test(cleanNumber)) {
          cardType = 'Visa';
        } else if (/^5[1-5]/.test(cleanNumber)) {
          cardType = 'Mastercard';
        } else if (/^3[47]/.test(cleanNumber)) {
          cardType = 'American Express';
        } else if (/^6/.test(cleanNumber)) {
          cardType = 'Discover';
        }
      }

      this.logOperation('validateCreditCard', { 
        cardNumber: cleanNumber.substring(0, 4) + '****', 
        isValid, 
        cardType 
      });

      const result: { isValid: boolean; cardType?: string } = { isValid };
      if (cardType) {
        result.cardType = cardType;
      }

      return this.createResponse(result);
    } catch (error) {
      this.handleError(error, 'Failed to validate credit card');
    }
  }
}

// Export singleton instance
export const validationService = new ValidationService();