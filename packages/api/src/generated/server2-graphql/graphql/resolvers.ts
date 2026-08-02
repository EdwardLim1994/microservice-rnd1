import type { GraphQLResolveInfo } from 'graphql';
import type { Server2GraphqlContextType } from './context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  _FieldSet: { input: unknown; output: unknown; }
};

export type Item = {
  __typename?: 'Item';
  id: Scalars['ID']['output'];
  item2s: Array<Item2>;
};

export type Item2 = {
  __typename?: 'Item2';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  item: Item;
  itemId: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Item2SearchHit = {
  __typename?: 'Item2SearchHit';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  itemId: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createItem2: Item2;
  deleteItem2: Scalars['Boolean']['output'];
  updateItem2: Item2;
};


export type MutationCreateItem2Args = {
  itemId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};


export type MutationDeleteItem2Args = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateItem2Args = {
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type Query = {
  __typename?: 'Query';
  item2?: Maybe<Item2>;
  item2s: Array<Item2>;
  search: Array<Item2SearchHit>;
};


export type QueryItem2Args = {
  id: Scalars['ID']['input'];
};


export type QuerySearchArgs = {
  query: Scalars['String']['input'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ReferenceResolver<TResult, TReference, TContext> = (
      reference: TReference,
      context: TContext,
      info: GraphQLResolveInfo
    ) => Promise<TResult> | TResult;

      type ScalarCheck<T, S> = S extends true ? T : NullableCheck<T, S>;
      type NullableCheck<T, S> = Maybe<T> extends T ? Maybe<ListCheck<NonNullable<T>, S>> : ListCheck<T, S>;
      type ListCheck<T, S> = T extends (infer U)[] ? NullableCheck<U, S>[] : GraphQLRecursivePick<T, S>;
      export type GraphQLRecursivePick<T, S> = { [K in keyof T & keyof S]: ScalarCheck<T[K], S[K]> };
    

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping of federation types */
export type FederationTypes = ResolversObject<{
  Item: Item;
  Item2: Item2;
}>;

/** Mapping of federation reference types */
export type FederationReferenceTypes = ResolversObject<{
  Item:
    ( { __typename: 'Item' }
    & GraphQLRecursivePick<FederationTypes['Item'], {"id":true}> );
  Item2:
    ( { __typename: 'Item2' }
    & GraphQLRecursivePick<FederationTypes['Item2'], {"id":true}> );
}>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Item: ResolverTypeWrapper<Item>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Item2: ResolverTypeWrapper<Item2>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Item2SearchHit: ResolverTypeWrapper<Item2SearchHit>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Item: Item | FederationReferenceTypes['Item'];
  ID: Scalars['ID']['output'];
  Item2: Item2 | FederationReferenceTypes['Item2'];
  String: Scalars['String']['output'];
  Item2SearchHit: Item2SearchHit;
  Mutation: Record<PropertyKey, never>;
  Boolean: Scalars['Boolean']['output'];
  Query: Record<PropertyKey, never>;
}>;

export type ItemResolvers<ContextType = Server2GraphqlContextType, ParentType extends ResolversParentTypes['Item'] = ResolversParentTypes['Item'], FederationReferenceType extends FederationReferenceTypes['Item'] = FederationReferenceTypes['Item']> = ResolversObject<{
  __resolveReference?: ReferenceResolver<Maybe<ResolversTypes['Item']> | FederationReferenceType, FederationReferenceType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  item2s?: Resolver<Array<ResolversTypes['Item2']>, ParentType, ContextType>;
}>;

export type Item2Resolvers<ContextType = Server2GraphqlContextType, ParentType extends ResolversParentTypes['Item2'] = ResolversParentTypes['Item2'], FederationReferenceType extends FederationReferenceTypes['Item2'] = FederationReferenceTypes['Item2']> = ResolversObject<{
  __resolveReference?: ReferenceResolver<Maybe<ResolversTypes['Item2']> | FederationReferenceType, FederationReferenceType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  item?: Resolver<ResolversTypes['Item'], ParentType, ContextType>;
  itemId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type Item2SearchHitResolvers<ContextType = Server2GraphqlContextType, ParentType extends ResolversParentTypes['Item2SearchHit'] = ResolversParentTypes['Item2SearchHit']> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  itemId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = Server2GraphqlContextType, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  createItem2?: Resolver<ResolversTypes['Item2'], ParentType, ContextType, RequireFields<MutationCreateItem2Args, 'itemId' | 'name'>>;
  deleteItem2?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteItem2Args, 'id'>>;
  updateItem2?: Resolver<ResolversTypes['Item2'], ParentType, ContextType, RequireFields<MutationUpdateItem2Args, 'id' | 'name'>>;
}>;

export type QueryResolvers<ContextType = Server2GraphqlContextType, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  item2?: Resolver<Maybe<ResolversTypes['Item2']>, ParentType, ContextType, RequireFields<QueryItem2Args, 'id'>>;
  item2s?: Resolver<Array<ResolversTypes['Item2']>, ParentType, ContextType>;
  search?: Resolver<Array<ResolversTypes['Item2SearchHit']>, ParentType, ContextType, RequireFields<QuerySearchArgs, 'query'>>;
}>;

export type Resolvers<ContextType = Server2GraphqlContextType> = ResolversObject<{
  Item?: ItemResolvers<ContextType>;
  Item2?: Item2Resolvers<ContextType>;
  Item2SearchHit?: Item2SearchHitResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
}>;

