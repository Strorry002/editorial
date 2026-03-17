import json
d = json.load(open("/tmp/nc2.json"))
print(f"Total cities: {d['total']}")
scores = [c['score'] for c in d['data']]
non_zero = [s for s in scores if s > 0]
print(f"Non-zero scores: {len(non_zero)}")
print(f"Zero scores: {len([s for s in scores if s == 0])}")
if non_zero:
    print(f"Score range: {min(non_zero)} - {max(non_zero)}")
# Show top 10
for c in sorted(d['data'], key=lambda x: x['score'], reverse=True)[:10]:
    print(f"  {c['flag']} {c['name']}: score={c['score']}, rent={c['rent']}, nomadScore from scores")
