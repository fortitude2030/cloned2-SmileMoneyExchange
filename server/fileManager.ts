import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface FileManagerConfig {
  baseUploadPath: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  retentionPeriodYears: number;
}

export class FileManager {
  private config: FileManagerConfig;

  constructor(config: FileManagerConfig) {
    this.config = config;
  }

  /**
   * Generate secure file path based on document type and organization
   */
  generateSecureFilePath(
    documentType: 'kyc' | 'vmf' | 'compliance',
    organizationId?: number,
    originalFilename?: string
  ): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const hash = crypto.randomBytes(16).toString('hex');
    const extension = originalFilename ? path.extname(originalFilename) : '.pdf';
    
    let basePath: string;
    let filename: string;

    switch (documentType) {
      case 'kyc':
        basePath = path.join(this.config.baseUploadPath, 'KYC_DOCS', organizationId?.toString() || 'general');
        filename = `KYC_${timestamp}_${hash}${extension}`;
        break;
      case 'vmf':
        basePath = path.join(this.config.baseUploadPath, 'VMF_DOCS');
        filename = `VMF_${timestamp}_${hash}${extension}`;
        break;
      case 'compliance':
        basePath = path.join(this.config.baseUploadPath, 'COMPLIANCE_REPORTS');
        filename = `COMP_${timestamp}_${hash}${extension}`;
        break;
      default:
        throw new Error('Invalid document type');
    }

    return path.join(basePath, filename);
  }

  /**
   * Ensure directory exists with proper permissions
   */
  async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true, mode: 0o750 });
    }
  }

  /**
   * Validate file security requirements
   */
  validateFile(file: any): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum limit of ${this.config.maxFileSize / (1024 * 1024)}MB`
      };
    }

    // Check minimum file size (prevent empty files)
    if (file.size < 1000) {
      return {
        valid: false,
        error: 'File is too small. Please upload a valid document.'
      };
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Move file to secure location with audit trail
   */
  async secureFileStorage(
    tempFilePath: string,
    documentType: 'kyc' | 'vmf' | 'compliance',
    organizationId?: number,
    originalFilename?: string
  ): Promise<{ finalPath: string; filename: string }> {
    const finalPath = this.generateSecureFilePath(documentType, organizationId, originalFilename);
    const directory = path.dirname(finalPath);
    
    // Ensure target directory exists
    await this.ensureDirectoryExists(directory);
    
    // Move file to secure location
    await fs.rename(tempFilePath, finalPath);
    
    // Set secure file permissions (owner read/write only)
    await fs.chmod(finalPath, 0o600);
    
    return {
      finalPath,
      filename: path.basename(finalPath)
    };
  }

  /**
   * Create audit log entry for file operations
   */
  async logFileOperation(
    operation: 'upload' | 'access' | 'delete',
    filePath: string,
    userId: string,
    metadata?: any
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      filePath,
      userId,
      metadata: metadata || {},
      checksum: await this.calculateFileChecksum(filePath)
    };

    const logDir = path.join(this.config.baseUploadPath, 'AUDIT_LOGS');
    await this.ensureDirectoryExists(logDir);
    
    const logFile = path.join(logDir, `file_audit_${new Date().toISOString().split('T')[0]}.jsonl`);
    
    try {
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Calculate file checksum for integrity verification
   */
  async calculateFileChecksum(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch {
      return 'unavailable';
    }
  }

  /**
   * Check if file exists and is accessible
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata for compliance tracking
   */
  async getFileMetadata(filePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
    checksum: string;
  } | null> {
    try {
      const stats = await fs.stat(filePath);
      const checksum = await this.calculateFileChecksum(filePath);
      
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        checksum
      };
    } catch {
      return null;
    }
  }

  /**
   * Archive old files based on retention policy
   */
  async archiveExpiredFiles(): Promise<void> {
    const currentDate = new Date();
    const retentionDate = new Date();
    retentionDate.setFullYear(currentDate.getFullYear() - this.config.retentionPeriodYears);

    // Implementation would scan directories and archive files older than retention period
    // This is a placeholder for the archival process
    console.log(`Archival process initiated for files older than ${retentionDate.toISOString()}`);
  }
}

// Default configuration for Zambian e-money platform
export const defaultFileManagerConfig: FileManagerConfig = {
  baseUploadPath: 'uploads',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'application/pdf'
  ],
  retentionPeriodYears: 7 // Bank of Zambia compliance requirement
};

export const fileManager = new FileManager(defaultFileManagerConfig);