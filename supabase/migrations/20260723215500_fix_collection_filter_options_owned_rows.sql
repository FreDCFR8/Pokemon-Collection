create or replace function public.get_collection_filter_options(
  p_collection_id uuid,
  p_set_code text default null,
  p_rarity text default null
)
returns jsonb
language sql
stable
set search_path = public
as $function$
  with owned_cards as (
    select
      cc.card_catalog_id,
      c.set_code,
      nullif(trim(c.rarity), '') as rarity
    from public.collection_cards cc
    join public.cards_catalog c
      on c.id = cc.card_catalog_id
    where cc.collection_id = p_collection_id
      and cc.status = 'owned'
      and cc.quantity > 0
  ),
  available_sets as (
    select distinct
      sc.set_code,
      sc.name
    from owned_cards oc
    join public.sets_catalog sc
      on sc.set_code = oc.set_code
    where oc.set_code is not null
      and (
        nullif(trim(p_rarity), '') is null
        or oc.rarity = trim(p_rarity)
      )
  ),
  available_rarities as (
    select distinct
      oc.rarity
    from owned_cards oc
    where oc.rarity is not null
      and (
        nullif(trim(p_set_code), '') is null
        or oc.set_code = trim(p_set_code)
      )
  )
  select jsonb_build_object(
    'sets',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'set_code', available_sets.set_code,
            'name', available_sets.name
          )
          order by available_sets.name
        )
        from available_sets
      ),
      '[]'::jsonb
    ),
    'rarities',
    coalesce(
      (
        select jsonb_agg(
          available_rarities.rarity
          order by available_rarities.rarity
        )
        from available_rarities
      ),
      '[]'::jsonb
    )
  );
$function$;

comment on function public.get_collection_filter_options(uuid, text, text)
is 'Returns set and rarity filter options for positive owned cards in one collection; wishlist and zero-quantity rows are excluded.';