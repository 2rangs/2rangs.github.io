
지도에 매장 위치 몇십 개를 찍었을 때는 잘 됩니다. 그런데 데이터가 전국 단위로 늘어나자 지도를 끌면 뚝뚝 끊기고, 줌을 바꾸면 잠깐 멈춥니다. 대부분은 점이 많아서가 아니라 **마커를 그리는 방식** 때문입니다. 보이는 개수를 줄이는 클러스터링과, 그리는 방식을 바꾸는 WebGL 레이어로 풀 수 있습니다.

## 마커 하나가 DOM 요소 하나일 때

지도 라이브러리의 기본 마커는 보통 HTML 요소입니다. MapLibre GL JS의 `Marker`도 `getElement()`로 꺼내 보면 `HTMLElement`가 나옵니다.

```js
import { Marker } from 'maplibre-gl';

stores.forEach((store) => {
  new Marker().setLngLat([store.lng, store.lat]).addTo(map);
});
```

몇십 개일 땐 CSS로 꾸미기도, 클릭 이벤트 붙이기도 아주 편합니다. 문제는 지도가 움직일 때입니다. 지도를 끌거나 줌할 때마다 모든 마커의 화면 위치를 다시 계산해서 옮겨야 하고, 요소가 수만 개면 매 프레임 그 일을 수만 번 해야 합니다. DOM 요소는 하나하나가 스타일과 레이아웃 정보를 지닌 무거운 객체라서, 개수가 늘수록 브라우저가 버거워합니다.

저도 처음엔 아이콘 용량부터 줄였는데, 문제는 이미지가 아니라 개수였습니다.

## 클러스터링으로 개수 줄이기

첫 번째 방법은 보이는 개수를 줄이는 것입니다. 멀리서 볼 때는 가까운 점들을 묶어서 "128" 같은 원 하나로 보여 주고, 확대하면 풀어 줍니다. 이걸 클러스터링이라고 합니다.

자바스크립트에서는 `supercluster` 라이브러리가 많이 쓰입니다. GeoJSON 포인트 배열을 넣고, 지금 보이는 범위와 줌을 주면 묶인 결과를 돌려줍니다.

```js
import Supercluster from 'supercluster';

const index = new Supercluster({ radius: 40, maxZoom: 16 });
index.load(points); // GeoJSON Point Feature 배열

function render() {
  const b = map.getBounds();
  const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  const features = index.getClusters(bbox, Math.floor(map.getZoom()));

  // features 안에는 묶인 클러스터와 낱개 포인트가 섞여 있습니다.
  // 여기서 화면에 보일 몇백 개만 그리면 됩니다.
}

map.on('moveend', render);
```

README 기준으로 `radius` 기본값은 40(픽셀), `maxZoom` 기본값은 16입니다. `getClusters`의 bbox는 `[서경, 남위, 동경, 북위]` 순서입니다. 한 번 `load()`한 인덱스는 바뀌지 않으니, 데이터가 바뀌면 새로 만들어야 합니다.

## 지도 엔진에 맡기는 방법

MapLibre를 쓴다면 굳이 따로 계산하지 않아도 됩니다. GeoJSON 소스에 `cluster: true`만 주면 엔진이 직접 묶어 주고, 마커를 DOM이 아니라 **레이어**로 그립니다.

```js
map.addSource('stores', {
  type: 'geojson',
  data: '/stores.geojson',
  cluster: true,
  clusterRadius: 50,
  clusterMaxZoom: 14,
});

map.addLayer({
  id: 'clusters',
  type: 'circle',
  source: 'stores',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#3b82f6',
    'circle-radius': ['step', ['get', 'point_count'], 16, 100, 24, 1000, 32],
  },
});

map.addLayer({
  id: 'store-points',
  type: 'circle',
  source: 'stores',
  filter: ['!', ['has', 'point_count']],
  paint: { 'circle-color': '#ef4444', 'circle-radius': 5 },
});

map.on('click', 'clusters', async (e) => {
  const feature = e.features[0];
  const zoom = await map
    .getSource('stores')
    .getClusterExpansionZoom(feature.properties.cluster_id);
  map.easeTo({ center: feature.geometry.coordinates, zoom });
});
```

묶인 점에는 `point_count`, `cluster_id` 같은 속성이 붙으므로 `filter`로 클러스터와 낱개를 나눠 그릴 수 있습니다. 최신 MapLibre에서는 `getClusterExpansionZoom`이 Promise를 돌려주니 `await`로 받으면 됩니다.

레이어로 그린 점은 DOM 요소가 아니라 지도와 같은 WebGL 캔버스에 그려집니다. 그래서 지도를 움직여도 요소를 하나하나 옮길 일이 없습니다.

## 묶지 않고 전부 보여 줘야 할 때

분포 자체를 보여 줘야 하는 시각화처럼 클러스터링이 답이 아닐 때도 있습니다. 이럴 땐 점을 GPU로 한꺼번에 그리는 방법을 씁니다. `deck.gl`은 이런 대용량 시각화를 위한 WebGL 기반 라이브러리이고, MapLibre와 함께 쓸 때는 `@deck.gl/maplibre`의 `MapLibreOverlay`를 지도 컨트롤로 붙입니다.

```js
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { ScatterplotLayer } from '@deck.gl/layers';

const overlay = new MapLibreOverlay({
  interleaved: true,
  layers: [
    new ScatterplotLayer({
      id: 'stores',
      data: stores,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 4,
      radiusUnits: 'pixels',
      getFillColor: [239, 68, 68],
      pickable: true,
    }),
  ],
});

map.addControl(overlay);
```

`interleaved: true`면 deck.gl 레이어가 MapLibre의 WebGL 컨텍스트 안에서 함께 그려져서, 지도 라벨 아래에 끼워 넣을 수도 있습니다. `pickable: true`를 주면 클릭이나 호버로 어떤 점인지 알아낼 수 있습니다.

WebGL로 그리면 빨라지는 대신, 마커 안에 버튼이나 복잡한 HTML을 넣기는 어려워집니다. 그런 정보는 클릭했을 때 팝업 하나로 보여 주는 편이 낫습니다.

## 무엇을 고를까

몇십~몇백 개이고 마커마다 모양이 복잡하다면 DOM 마커로 충분합니다. 개수가 많지만 멀리서 묶여도 괜찮다면 클러스터링, 많고 전부 보여야 한다면 WebGL 레이어를 씁니다. 몇 개부터 느려지는지는 기기와 마커 모양마다 다르니, 직접 넣어 보고 성능 탭으로 확인하세요.

## 참고

- [supercluster README](https://github.com/mapbox/supercluster)
- [MapLibre Style Spec, Sources](https://maplibre.org/maplibre-style-spec/sources/)
- [MapLibre GL JS, Create and style clusters](https://maplibre.org/maplibre-gl-js/docs/examples/create-and-style-clusters/)
- [MapLibre GL JS, GeoJSONSource](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/)
- [MapLibre GL JS, Marker](https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/)
- [deck.gl, Using with MapLibre](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre)
- [deck.gl, ScatterplotLayer](https://deck.gl/docs/api-reference/layers/scatterplot-layer)
