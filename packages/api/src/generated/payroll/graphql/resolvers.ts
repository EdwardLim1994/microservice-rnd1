import type { GraphQLResolveInfo } from 'graphql';
import type { PayrollContextType } from './context';
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

export type Employee = {
  __typename?: 'Employee';
  id: Scalars['ID']['output'];
};

/** Input for triggering the monthly payslip generation job. */
export type GeneratePayslipsInput = {
  /** Month to generate payslips for (1–12). */
  month: Scalars['Int']['input'];
  /** Year to generate payslips for (e.g. 2026). */
  year: Scalars['Int']['input'];
};

/** Result of triggering the monthly payslip generation job. */
export type GeneratePayslipsResult = {
  __typename?: 'GeneratePayslipsResult';
  /** List of employee IDs for which generation failed. Empty if all succeeded. */
  failed: Array<Scalars['ID']['output']>;
  /** List of successfully generated payslip records. */
  generated: Array<Payslip>;
};

export type Mutation = {
  __typename?: 'Mutation';
  /**
   * Trigger monthly payslip generation for all active employees. Called by the
   * cron server. Generates a PDF per employee via the standalone StorePayslip
   * component, and creates a notification per employee. Returns lists of
   * succeeded and failed employee IDs.
   */
  generatePayslips: GeneratePayslipsResult;
  /** Mark a specific notification as read. */
  markNotificationRead: Notification;
};

export type MutationGeneratePayslipsArgs = {
  input: GeneratePayslipsInput;
};

export type MutationMarkNotificationReadArgs = {
  id: Scalars['ID']['input'];
};

/** An in-app notification record for an employee. */
export type Notification = {
  __typename?: 'Notification';
  /** Timestamp when the notification was created. */
  createdAt: Scalars['String']['output'];
  /** The employee this notification is addressed to. */
  employee: Employee;
  /** Unique internal identifier for the notification. */
  id: Scalars['ID']['output'];
  /** Human-readable notification message (e.g. 'Your January 2026 payslip is ready'). */
  message: Scalars['String']['output'];
  /** Whether the employee has read/dismissed this notification. */
  read: Scalars['Boolean']['output'];
};

/** Represents a generated payslip record stored in Minio. */
export type Payslip = {
  __typename?: 'Payslip';
  /** The employee this payslip was generated for. */
  employee: Employee;
  /** Timestamp when the payslip PDF was generated and stored. */
  generatedAt: Scalars['String']['output'];
  /** Unique internal identifier for the payslip record. */
  id: Scalars['ID']['output'];
  /** Minio object key where the PDF is stored (e.g. payslips/{employeeId}/{year}/{month}.pdf). */
  minioObjectKey: Scalars['String']['output'];
  /** Calendar month the payslip covers (1–12). */
  month: Scalars['Int']['output'];
  /** Calendar year the payslip covers (e.g. 2026). */
  year: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  /** Fetch all notifications for a given employee. Sorted by createdAt descending. */
  notifications: Array<Notification>;
};

export type QueryNotificationsArgs = {
  employeeId: Scalars['ID']['input'];
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
  Notification: Notification;
  Payslip: Payslip;
}>;

/** Mapping of federation reference types */
export type FederationReferenceTypes = ResolversObject<{
  Employee: { __typename: 'Employee' } & GraphQLRecursivePick<
    FederationTypes['Employee'],
    { id: true }
  >;
  Notification: { __typename: 'Notification' } & GraphQLRecursivePick<
    FederationTypes['Notification'],
    { id: true }
  >;
  Payslip: { __typename: 'Payslip' } & GraphQLRecursivePick<
    FederationTypes['Payslip'],
    { id: true }
  >;
}>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Employee: ResolverTypeWrapper<Employee>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  GeneratePayslipsInput: GeneratePayslipsInput;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  GeneratePayslipsResult: ResolverTypeWrapper<GeneratePayslipsResult>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Notification: ResolverTypeWrapper<Notification>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Payslip: ResolverTypeWrapper<Payslip>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Employee: Employee | FederationReferenceTypes['Employee'];
  ID: Scalars['ID']['output'];
  GeneratePayslipsInput: GeneratePayslipsInput;
  Int: Scalars['Int']['output'];
  GeneratePayslipsResult: GeneratePayslipsResult;
  Mutation: Record<PropertyKey, never>;
  Notification: Notification | FederationReferenceTypes['Notification'];
  String: Scalars['String']['output'];
  Boolean: Scalars['Boolean']['output'];
  Payslip: Payslip | FederationReferenceTypes['Payslip'];
  Query: Record<PropertyKey, never>;
}>;

export type EmployeeResolvers<
  ContextType = PayrollContextType,
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
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
}>;

export type GeneratePayslipsResultResolvers<
  ContextType = PayrollContextType,
  ParentType extends
    ResolversParentTypes['GeneratePayslipsResult'] = ResolversParentTypes['GeneratePayslipsResult'],
> = ResolversObject<{
  failed?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType>;
  generated?: Resolver<
    Array<ResolversTypes['Payslip']>,
    ParentType,
    ContextType
  >;
}>;

export type MutationResolvers<
  ContextType = PayrollContextType,
  ParentType extends
    ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation'],
> = ResolversObject<{
  generatePayslips?: Resolver<
    ResolversTypes['GeneratePayslipsResult'],
    ParentType,
    ContextType,
    RequireFields<MutationGeneratePayslipsArgs, 'input'>
  >;
  markNotificationRead?: Resolver<
    ResolversTypes['Notification'],
    ParentType,
    ContextType,
    RequireFields<MutationMarkNotificationReadArgs, 'id'>
  >;
}>;

export type NotificationResolvers<
  ContextType = PayrollContextType,
  ParentType extends
    ResolversParentTypes['Notification'] = ResolversParentTypes['Notification'],
  FederationReferenceType extends
    FederationReferenceTypes['Notification'] = FederationReferenceTypes['Notification'],
> = ResolversObject<{
  __resolveReference?: ReferenceResolver<
    Maybe<ResolversTypes['Notification']> | FederationReferenceType,
    FederationReferenceType,
    ContextType
  >;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  employee?: Resolver<ResolversTypes['Employee'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  read?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
}>;

export type PayslipResolvers<
  ContextType = PayrollContextType,
  ParentType extends
    ResolversParentTypes['Payslip'] = ResolversParentTypes['Payslip'],
  FederationReferenceType extends
    FederationReferenceTypes['Payslip'] = FederationReferenceTypes['Payslip'],
> = ResolversObject<{
  __resolveReference?: ReferenceResolver<
    Maybe<ResolversTypes['Payslip']> | FederationReferenceType,
    FederationReferenceType,
    ContextType
  >;
  employee?: Resolver<ResolversTypes['Employee'], ParentType, ContextType>;
  generatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  minioObjectKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  month?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  year?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type QueryResolvers<
  ContextType = PayrollContextType,
  ParentType extends
    ResolversParentTypes['Query'] = ResolversParentTypes['Query'],
> = ResolversObject<{
  notifications?: Resolver<
    Array<ResolversTypes['Notification']>,
    ParentType,
    ContextType,
    RequireFields<QueryNotificationsArgs, 'employeeId'>
  >;
}>;

export type Resolvers<ContextType = PayrollContextType> = ResolversObject<{
  Employee?: EmployeeResolvers<ContextType>;
  GeneratePayslipsResult?: GeneratePayslipsResultResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Notification?: NotificationResolvers<ContextType>;
  Payslip?: PayslipResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
}>;
