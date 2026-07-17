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

export type GeneratePayslipsInput = {
  month: Scalars['Int']['input'];
  year: Scalars['Int']['input'];
};

export type GeneratePayslipsResult = {
  __typename?: 'GeneratePayslipsResult';
  failed: Array<Scalars['ID']['output']>;
  generated: Array<Payslip>;
};

export type Mutation = {
  __typename?: 'Mutation';
  generatePayslips: GeneratePayslipsResult;
  markNotificationRead: Notification;
};

export type MutationGeneratePayslipsArgs = {
  input: GeneratePayslipsInput;
};

export type MutationMarkNotificationReadArgs = {
  id: Scalars['ID']['input'];
};

export type Notification = {
  __typename?: 'Notification';
  createdAt: Scalars['String']['output'];
  employee: Employee;
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
  read: Scalars['Boolean']['output'];
};

export type Payslip = {
  __typename?: 'Payslip';
  employee: Employee;
  generatedAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  minioObjectKey: Scalars['String']['output'];
  month: Scalars['Int']['output'];
  year: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
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
