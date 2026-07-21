export class DomainError extends Error {}

export class NotFoundError extends DomainError {}
export class InvalidTransitionError extends DomainError {}
export class NotEligibleError extends DomainError {}
export class AlreadyVotedError extends DomainError {}
export class ElectionNotOpenError extends DomainError {}
export class CandidateNotApprovedError extends DomainError {}
export class DuplicateApplicationError extends DomainError {}
export class StaleImportError extends DomainError {}
export class AlreadyRevokedError extends DomainError {}
