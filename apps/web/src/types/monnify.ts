export interface MonnifyAuthResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    accessToken: string;
    expiresIn: number;
  };
}

export interface MonnifyBVNMatchResponse {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: {
    name: string;
    bvn: string;
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
  responseBody: {
    nin: string;
    firstName: string;
    lastName: string;
    middleName: string;
    dateOfBirth: string;
    gender: string;
    mobileNumber: string;
  };
}
