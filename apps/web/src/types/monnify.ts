export interface MonnifyAuthResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody?: {
    accessToken: string;
    expiresIn: number;
  };
}

export interface MonnifyBVNMatchResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  // responseBody is absent when requestSuccessful is false
  responseBody?: {
    name: string;
    bvn: string;
    // BVN endpoint uses mobileNo (NIN endpoint uses mobileNumber — different Monnify APIs)
    mobileNo: string;
    dateOfBirth: string;
    matchStatus: 'FULL_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH';
    individualDetails: {
      firstName: string;
      lastName: string;
      middleName: string;
      dateOfBirth: string;
      mobileNo: string;
    };
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
