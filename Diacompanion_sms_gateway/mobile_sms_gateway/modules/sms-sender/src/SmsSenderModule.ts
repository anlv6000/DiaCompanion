import { requireNativeModule } from 'expo';

export type SmsSendResult = {
  success: boolean;
  phoneNumber: string;
  message: string;
};

type SmsSenderModuleType = {
  sendSms(
    phoneNumber: string,
    message: string
  ): Promise<SmsSendResult>;
};

export default requireNativeModule<SmsSenderModuleType>('SmsSender');