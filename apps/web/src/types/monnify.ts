export interface MonnifyAuthResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody?: {
    accessToken: string;
    expiresIn: number;
  };
}

export interface MonnifyNINResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  // responseBody is absent when requestSuccessful is false
  responseBody?: {
    nin: string;
    firstName: string;
    lastName: string;
    middleName: string;
    dateOfBirth: string;
    gender: string;
    // NIN endpoint uses mobileNumber (BVN endpoint uses mobileNo — different Monnify APIs)
    mobileNumber: string;
  };
}
