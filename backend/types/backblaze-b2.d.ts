declare module 'backblaze-b2' {
    interface B2Options {
        applicationKeyId: string | undefined;
        applicationKey: string | undefined;
    }

    interface BucketResponse {
        data: {
            buckets: Array<{ bucketId: string; bucketName: string }>;
        };
    }

    interface UploadUrlResponse {
        data: {
            uploadUrl: string;
            authorizationToken: string;
        };
    }

    interface FileListResponse {
        data: {
            files: Array<{ fileName: string; fileId: string }>;
        };
    }

    interface DownloadResponse {
        data: ArrayBuffer;
    }

    interface UploadOptions {
        uploadUrl: string;
        uploadAuthToken: string;
        fileName: string;
        data: Buffer;
        mime: string;
    }

    class B2 {
        constructor(options: B2Options);
        authorize(): Promise<void>;
        getBucket(params: { bucketName: string }): Promise<BucketResponse>;
        getUploadUrl(params: { bucketId: string }): Promise<UploadUrlResponse>;
        uploadFile(options: UploadOptions): Promise<void>;
        listFileNames(params: { bucketId: string; startFileName: string; maxFileCount: number }): Promise<FileListResponse>;
        downloadFileByName(params: { bucketName: string; fileName: string; responseType: string }): Promise<DownloadResponse>;
    }

    export = B2;
}
