import type { GraphQLResolveInfo } from 'graphql';
import type { EmployeeContextType } from './context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  _FieldSet: { input: unknown; output: unknown };
};

/** Generic acknowledgement result for operations that do not return domain data. */
export type AcknowledgementResult = {
  __typename?: 'AcknowledgementResult';
  /** Optional human-readable message for the caller. */
  message?: Maybe<Scalars['String']['output']>;
  /** True if the operation was accepted successfully. */
  success: Scalars['Boolean']['output'];
};

/** Input for assigning or reassigning a supervisor to an employee. */
export type AssignSupervisorInput = {
  /** Internal ID of the employee to update. */
  employeeId: Scalars['ID']['input'];
  /** Internal ID of the employee to assign as supervisor. */
  supervisorId: Scalars['ID']['input'];
};

/** Input for step 2 of the password reset flow — confirm and set new password. */
export type ConfirmPasswordResetInput = {
  /** New password to set. Must meet Authentik password policy. */
  newPassword: Scalars['String']['input'];
  /** Reset token received via email link from Authentik. */
  resetToken: Scalars['String']['input'];
};

/** Represents an employee registered in the HR system. */
export type Employee = {
  __typename?: 'Employee';
  /** Timestamp when the employee record was created. */
  createdAt: Scalars['String']['output'];
  /** Department the employee belongs to (e.g. Engineering, Finance). */
  department: Scalars['String']['output'];
  /** Human-readable employee identifier assigned by HR (e.g. EMP-001). */
  employeeId: Scalars['String']['output'];
  /** Full name of the employee. */
  fullName: Scalars['String']['output'];
  /** Gross monthly salary of the employee in the base currency. */
  grossSalary: Scalars['Float']['output'];
  /** Unique internal identifier for the employee (UUID). */
  id: Scalars['ID']['output'];
  /** Job role or title of the employee (e.g. Software Engineer). */
  role: Scalars['String']['output'];
  /**
   * The employee who is assigned as this employee's supervisor.
   * Null if no supervisor has been assigned. Supports hierarchical assignment.
   */
  supervisor?: Maybe<Employee>;
};

export type Mutation = {
  __typename?: 'Mutation';
  /**
   * Assign or reassign a supervisor for an existing employee. The supervisor
   * must be an existing employee. An employee cannot be their own supervisor.
   */
  assignSupervisor: Employee;
  /**
   * Step 2 of password reset — confirm reset token and set new password via Authentik.
   * Returns error if token is invalid, expired, or password does not meet policy.
   */
  confirmPasswordReset: AcknowledgementResult;
  /**
   * Register a new employee in the system. Creates a Postgres record and an
   * Authentik account with an auto-generated temporary password. Returns the
   * employee record and the temporary password (shown once).
   */
  registerEmployee: RegisterEmployeeResult;
  /**
   * Step 1 of password reset — request a reset email via Authentik.
   * Always returns success to avoid leaking whether an email is registered.
   */
  requestPasswordReset: AcknowledgementResult;
};

export type MutationAssignSupervisorArgs = {
  input: AssignSupervisorInput;
};

export type MutationConfirmPasswordResetArgs = {
  input: ConfirmPasswordResetInput;
};

export type MutationRegisterEmployeeArgs = {
  input: RegisterEmployeeInput;
};

export type MutationRequestPasswordResetArgs = {
  input: RequestPasswordResetInput;
};

export type Query = {
  __typename?: 'Query';
  /** Fetch a single employee by their internal ID. */
  employee?: Maybe<Employee>;
  /** Fetch all employees. Supports filtering by department or role. */
  employees: Array<Employee>;
};

export type QueryEmployeeArgs = {
  id: Scalars['ID']['input'];
};

export type QueryEmployeesArgs = {
  department?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<Scalars['String']['input']>;
};

/** Input for registering a new employee. */
export type RegisterEmployeeInput = {
  /** Department name. */
  department: Scalars['String']['input'];
  /** Unique human-readable employee identifier (e.g. EMP-001). */
  employeeId: Scalars['String']['input'];
  /** Full name of the employee. */
  fullName: Scalars['String']['input'];
  /** Gross monthly salary. Must be a positive number. */
  grossSalary: Scalars['Float']['input'];
  /** Job role or title. */
  role: Scalars['String']['input'];
  /**
   * Internal ID of the employee to assign as supervisor.
   * Optional — can be assigned later via assignSupervisor.
   */
  supervisorId?: InputMaybe<Scalars['ID']['input']>;
};

/**
 * Result returned after successfully registering a new employee. Includes the
 * auto-generated temporary password, returned only once.
 */
export type RegisterEmployeeResult = {
  __typename?: 'RegisterEmployeeResult';
  /** The newly created employee record. */
  employee: Employee;
  /**
   * Auto-generated temporary password for the employee's Authentik account.
   * Shown once to HR — not stored in the system after this response.
   */
  temporaryPassword: Scalars['String']['output'];
};

/** Input for step 1 of the password reset flow — request a reset email. */
export type RequestPasswordResetInput = {
  /** Registered email address of the employee. */
  email: Scalars['String']['input'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ReferenceResolver<TResult, TReference, TContext> = (
  reference: TReference,
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

type ScalarCheck<T, S> = S extends true ? T : NullableCheck<T, S>;
type NullableCheck<T, S> =
  Maybe<T> extends T ? Maybe<ListCheck<NonNullable<T>, S>> : ListCheck<T, S>;
type ListCheck<T, S> = T extends (infer U)[]
  ? NullableCheck<U, S>[]
  : GraphQLRecursivePick<T, S>;
export type GraphQLRecursivePick<T, S> = {
  [K in keyof T & keyof S]: ScalarCheck<T[K], S[K]>;
};

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<
  TResult,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> {
  subscribe: SubscriptionSubscribeFn<
    { [key in TKey]: TResult },
    TParent,
    TContext,
    TArgs
  >;
  resolve?: SubscriptionResolveFn<
    TResult,
    { [key in TKey]: TResult },
    TContext,
    TArgs
  >;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ((
      ...args: any[]
    ) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<
  TTypes,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo,
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<
  T = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
> = (
  obj: T,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = Record<PropertyKey, never>,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/** Mapping of federation types */
export type FederationTypes = ResolversObject<{
  Employee: Employee;
}>;

/** Mapping of federation reference types */
export type FederationReferenceTypes = ResolversObject<{
  Employee: { __typename: 'Employee' } & GraphQLRecursivePick<
    FederationTypes['Employee'],
    { id: true }
  >;
}>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AcknowledgementResult: ResolverTypeWrapper<AcknowledgementResult>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  AssignSupervisorInput: AssignSupervisorInput;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  ConfirmPasswordResetInput: ConfirmPasswordResetInput;
  Employee: ResolverTypeWrapper<Employee>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RegisterEmployeeInput: RegisterEmployeeInput;
  RegisterEmployeeResult: ResolverTypeWrapper<RegisterEmployeeResult>;
  RequestPasswordResetInput: RequestPasswordResetInput;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AcknowledgementResult: AcknowledgementResult;
  String: Scalars['String']['output'];
  Boolean: Scalars['Boolean']['output'];
  AssignSupervisorInput: AssignSupervisorInput;
  ID: Scalars['ID']['output'];
  ConfirmPasswordResetInput: ConfirmPasswordResetInput;
  Employee: Employee | FederationReferenceTypes['Employee'];
  Float: Scalars['Float']['output'];
  Mutation: Record<PropertyKey, never>;
  Query: Record<PropertyKey, never>;
  RegisterEmployeeInput: RegisterEmployeeInput;
  RegisterEmployeeResult: RegisterEmployeeResult;
  RequestPasswordResetInput: RequestPasswordResetInput;
}>;

export type AcknowledgementResultResolvers<
  ContextType = EmployeeContextType,
  ParentType extends
    ResolversParentTypes['AcknowledgementResult'] = ResolversParentTypes['AcknowledgementResult'],
> = ResolversObject<{
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
}>;

export type EmployeeResolvers<
  ContextType = EmployeeContextType,
  ParentType extends
    ResolversParentTypes['Employee'] = ResolversParentTypes['Employee'],
  FederationReferenceType extends
    FederationReferenceTypes['Employee'] = FederationReferenceTypes['Employee'],
> = ResolversObject<{
  __resolveReference?: ReferenceResolver<
    Maybe<ResolversTypes['Employee']> | FederationReferenceType,
    FederationReferenceType,
    ContextType
  >;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  department?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  employeeId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fullName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grossSalary?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  supervisor?: Resolver<
    Maybe<ResolversTypes['Employee']>,
    ParentType,
    ContextType
  >;
}>;

export type MutationResolvers<
  ContextType = EmployeeContextType,
  ParentType extends
    ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation'],
> = ResolversObject<{
  assignSupervisor?: Resolver<
    ResolversTypes['Employee'],
    ParentType,
    ContextType,
    RequireFields<MutationAssignSupervisorArgs, 'input'>
  >;
  confirmPasswordReset?: Resolver<
    ResolversTypes['AcknowledgementResult'],
    ParentType,
    ContextType,
    RequireFields<MutationConfirmPasswordResetArgs, 'input'>
  >;
  registerEmployee?: Resolver<
    ResolversTypes['RegisterEmployeeResult'],
    ParentType,
    ContextType,
    RequireFields<MutationRegisterEmployeeArgs, 'input'>
  >;
  requestPasswordReset?: Resolver<
    ResolversTypes['AcknowledgementResult'],
    ParentType,
    ContextType,
    RequireFields<MutationRequestPasswordResetArgs, 'input'>
  >;
}>;

export type QueryResolvers<
  ContextType = EmployeeContextType,
  ParentType extends
    ResolversParentTypes['Query'] = ResolversParentTypes['Query'],
> = ResolversObject<{
  employee?: Resolver<
    Maybe<ResolversTypes['Employee']>,
    ParentType,
    ContextType,
    RequireFields<QueryEmployeeArgs, 'id'>
  >;
  employees?: Resolver<
    Array<ResolversTypes['Employee']>,
    ParentType,
    ContextType,
    Partial<QueryEmployeesArgs>
  >;
}>;

export type RegisterEmployeeResultResolvers<
  ContextType = EmployeeContextType,
  ParentType extends
    ResolversParentTypes['RegisterEmployeeResult'] = ResolversParentTypes['RegisterEmployeeResult'],
> = ResolversObject<{
  employee?: Resolver<ResolversTypes['Employee'], ParentType, ContextType>;
  temporaryPassword?: Resolver<
    ResolversTypes['String'],
    ParentType,
    ContextType
  >;
}>;

export type Resolvers<ContextType = EmployeeContextType> = ResolversObject<{
  AcknowledgementResult?: AcknowledgementResultResolvers<ContextType>;
  Employee?: EmployeeResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RegisterEmployeeResult?: RegisterEmployeeResultResolvers<ContextType>;
}>;
