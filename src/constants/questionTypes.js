export const QUESTION_TYPES = Object.freeze({
  SINGLE_CHOICE: 'single_choice',
  MULTIPLE_CHOICE: 'multiple_choice',
  NUMERIC_RATING: 'numeric_rating',
  LIKERT_SCALE: 'likert_scale',
  SHORT_TEXT: 'short_text',
  LONG_TEXT: 'long_text',
  YES_NO: 'yes_no'
});

export const ALL_QUESTION_TYPES = Object.freeze(Object.values(QUESTION_TYPES));

export const LIKERT_SCALES = Object.freeze({
  FIVE_POINT_AGREEMENT: [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly Agree' }
  ],
  FIVE_POINT_QUALITY: [
    { value: 1, label: 'Poor' },
    { value: 2, label: 'Fair' },
    { value: 3, label: 'Good' },
    { value: 4, label: 'Very Good' },
    { value: 5, label: 'Excellent' }
  ]
});
