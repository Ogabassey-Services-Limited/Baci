// Compatibility barrel for existing web imports. New runtime modules stay
// cohesive, while shared v2 contracts remain owned by @baci/shared/schemas.
export {
  quizV2ActiveAttemptResponseSchema,
  quizV2AttemptResponseSchema,
  quizV2EventSchema,
  quizV2EventsResponseSchema,
  quizV2QuestionSchema,
  quizV2ResultResponseSchema,
  startQuizAttemptV2RequestSchema,
} from '@baci/shared/schemas';
export * from './quiz-schema-authoring';
export * from './quiz-schema-input';
export * from './quiz-schema-launch';
export * from './quiz-schema-query';
export * from './quiz-schema-response';
export * from './quiz-schema-row';
