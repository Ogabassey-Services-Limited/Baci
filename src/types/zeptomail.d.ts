declare module 'zeptomail' {
  export interface SendMailClientConfig {
    url: string;
    token: string;
  }

  export interface EmailAddress {
    address: string;
    name?: string;
  }

  export interface Recipient {
    email_address: EmailAddress;
  }

  export interface RecipientWithMergeInfo extends Recipient {
    merge_info?: Record<string, string>;
  }

  export interface SendMailParams {
    from: EmailAddress;
    to: Recipient[];
    cc?: Recipient[];
    bcc?: Recipient[];
    subject: string;
    htmlbody?: string;
    textbody?: string;
    reply_to?: EmailAddress[];
    client_reference?: string;
    mime_headers?: Record<string, string>;
    attachments?: Array<{
      name: string;
      content: string;
      mime_type: string;
    }>;
  }

  export interface SendMailWithTemplateParams {
    template_key?: string;
    template_alias?: string;
    from: EmailAddress;
    to: Recipient[];
    cc?: Recipient[];
    bcc?: Recipient[];
    merge_info?: Record<string, string>;
    reply_to?: EmailAddress[];
    client_reference?: string;
    mime_headers?: Record<string, string>;
  }

  export interface BatchMailWithTemplateParams {
    template_key?: string;
    template_alias?: string;
    from: EmailAddress;
    to: RecipientWithMergeInfo[];
    reply_to?: EmailAddress[];
    client_reference?: string;
  }

  export interface SendMailResponse {
    request_id: string;
    message?: string;
    data?: unknown[];
  }

  export class SendMailClient {
    constructor(config: SendMailClientConfig);
    sendMail(params: SendMailParams): Promise<SendMailResponse>;
    sendMailWithTemplate(params: SendMailWithTemplateParams): Promise<SendMailResponse>;
    mailBatchWithTemplate(params: BatchMailWithTemplateParams): Promise<SendMailResponse>;
  }
}
