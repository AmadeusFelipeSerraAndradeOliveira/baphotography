import test from "node:test";
import assert from "node:assert/strict";

function sortAlbums(albums) {
  return [...albums].sort((a, b) => {
    if (b.featured && !a.featured) return 1;
    if (a.featured && !b.featured) return -1;
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });
}

function filterAlbumsByCategory(albums, category) {
  if (!category) return albums;
  return albums.filter((a) => (a.category || "").toLowerCase() === category.toLowerCase());
}

test("ordenação de álbuns prioriza destaques e respeita campo order", () => {
  const albums = [
    { id: "1", title: "Álbum Normal 1", order: 10, featured: false },
    { id: "2", title: "Álbum Destaque 2", order: 20, featured: true },
    { id: "3", title: "Álbum Normal 2", order: 5, featured: false },
    { id: "4", title: "Álbum Destaque 1", order: 15, featured: true }
  ];

  const sorted = sortAlbums(albums);
  assert.equal(sorted[0].id, "4");
  assert.equal(sorted[1].id, "2");
  assert.equal(sorted[2].id, "3");
  assert.equal(sorted[3].id, "1");
});

test("filtro por categoria seleciona corretamente sem case sensitivity", () => {
  const albums = [
    { id: "1", category: "Casamentos" },
    { id: "2", category: "Pré-wedding" },
    { id: "3", category: "casamentos" },
    { id: "4", category: "Videografia" }
  ];

  const casamentos = filterAlbumsByCategory(albums, "Casamentos");
  assert.equal(casamentos.length, 2);
  assert.deepEqual(casamentos.map((x) => x.id), ["1", "3"]);

  const all = filterAlbumsByCategory(albums, "");
  assert.equal(all.length, 4);
});
